//
//  DeviceActivityMonitorExtension.swift
//  ActivityMonitorExtension
//
//  Created by Robert Herber on 2023-07-05.
//

import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import NotificationCenter
import StoreKit
import os

// Product IDs that grant access to scheduled blocks. Must match the
// products configured in App Store Connect / RevenueCat. Lifetime IAPs
// have `expirationDate == nil` and pass through the active check.
private let NOTHING_PRO_PRODUCT_IDS: Set<String> = [
  "nothing_monthly",
  "nothing_yearly",
  "nothing_lifetime",
]

// Subscription status mirrored from RevenueCat by the host app on every
// CustomerInfo resolve (see lib/subscription.ts). RC is the same source of
// truth the app's UI uses; reading it here keeps the gate consistent with
// what the user sees. A direct StoreKit read in this extension process can
// come back EMPTY right after a reinstall or in sandbox/TestFlight even
// though the subscription is real — so StoreKit is only a fallback signal,
// never the primary one.
private let RC_STATUS_KEY = "nothing_subscription_status"
private let RC_EXPIRES_AT_KEY = "nothing_subscription_expires_at"
// Covers the auto-renewal window when the app hasn't been opened to refresh
// the mirror since the subscription renewed.
private let RC_EXPIRY_GRACE: TimeInterval = 24 * 60 * 60

private enum EntitlementVerdict {
  case allow
  case deny
  // No usable mirror data — fall back to the StoreKit check.
  case unknown
}

private func mirroredEntitlementVerdict() -> EntitlementVerdict {
  guard let status = userDefaults?.string(forKey: RC_STATUS_KEY) else {
    return .unknown
  }
  if status != "active" {
    return .deny
  }
  let expiresAtMs = userDefaults?.object(forKey: RC_EXPIRES_AT_KEY) as? Double ?? -1
  if expiresAtMs <= 0 {
    // Lifetime purchase or RC reported no expiry.
    return .allow
  }
  let expiresAt = Date(timeIntervalSince1970: expiresAtMs / 1000)
  if Date() <= expiresAt.addingTimeInterval(RC_EXPIRY_GRACE) {
    return .allow
  }
  // Mirror says active but its expiry passed more than the grace period ago
  // and the app hasn't refreshed it — most likely an auto-renewal the app
  // hasn't observed yet, possibly a lapse. Let StoreKit decide.
  return .unknown
}

@available(iOS 15.0, *)
private func hasActiveNothingSubscription(timeout: TimeInterval) -> Bool {
  let semaphore = DispatchSemaphore(value: 0)
  var active = false
  Task {
    for await result in Transaction.currentEntitlements {
      if case .verified(let txn) = result,
         NOTHING_PRO_PRODUCT_IDS.contains(txn.productID),
         txn.revocationDate == nil,
         (txn.expirationDate.map { $0 > Date() } ?? true) {
        active = true
        break
      }
    }
    semaphore.signal()
  }
  // Fail-open on timeout — don't strand a paying user behind a missed
  // block from a transient StoreKit hiccup. Authoritative cases (refund,
  // cancellation, expiry) resolve in well under the timeout.
  return semaphore.wait(timeout: .now() + timeout) == .timedOut ? true : active
}

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    logger.log("intervalDidStart")

    // Subscription gate. Primary signal: RC status mirrored into the app
    // group by the host app — consistent with the UI's idea of "subscribed".
    // StoreKit is consulted only when the mirror is absent or stale, and an
    // empty StoreKit result skips this fire WITHOUT killing the monitor
    // (StoreKit-empty is a known false negative after reinstall/in sandbox;
    // the next occurrence re-checks). Only the authoritative mirror-deny
    // self-cleans the monitor — JS also unschedules on the inactive
    // transition, this is the belt to that suspenders.
    switch mirroredEntitlementVerdict() {
    case .allow:
      break
    case .deny:
      logger.log("intervalDidStart skipped — subscription inactive (mirrored)")
      DeviceActivityCenter().stopMonitoring([activity])
      return
    case .unknown:
      if #available(iOS 15.0, *) {
        if !hasActiveNothingSubscription(timeout: 2.0) {
          logger.log("intervalDidStart skipped — no active subscription (StoreKit)")
          return
        }
      }
    }

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "intervalDidStart",
      eventName: nil
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "intervalDidStart"
    )

    notifyAppWithName(name: "intervalDidStart")
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    logger.log("intervalDidEnd")

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "intervalDidEnd",
      eventName: nil
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "intervalDidEnd"
    )

    notifyAppWithName(name: "intervalDidEnd")
  }

  func executeActionsForEvent(
    activityName: String,
    callbackName: String,
    eventName: String?
  ) {
    let triggeredBy =
      eventName != nil
      ? "actions_for_\(activityName)_\(callbackName)_\(eventName!)"
      : "actions_for_\(activityName)_\(callbackName)"

    let placeholders = [
      "activityName": activityName,
      "callbackName": callbackName,
      "eventName": eventName
    ]

    let originalWhitelist = getCurrentWhitelist()
    let originalBlocklist = getCurrentBlocklist()

    CFPreferencesAppSynchronize(kCFPreferencesCurrentApplication)

    if let actions = userDefaults?.array(forKey: triggeredBy) {
      actions.forEach { actionRaw in
        if let action = actionRaw as? [String: Any] {
          let skipIfAlreadyTriggeredAfter = action["skipIfAlreadyTriggeredAfter"] as? Double
          let skipIfLargerEventRecordedAfter = action["skipIfLargerEventRecordedAfter"] as? Double
          let skipIfAlreadyTriggeredWithinMS = action["skipIfAlreadyTriggeredWithinMS"] as? Double
          let skipIfLargerEventRecordedWithinMS =
            action["skipIfLargerEventRecordedWithinMS"] as? Double
          let skipIfLargerEventRecordedSinceIntervalStarted =
            action["skipIfLargerEventRecordedSinceIntervalStarted"] as? Bool
          let neverTriggerBefore = action["neverTriggerBefore"] as? Double
          let skipIfAlreadyTriggeredBefore = action["skipIfAlreadyTriggeredBefore"] as? Double

          let skipIfAlreadyTriggeredBetweenFromDate =
            action["skipIfAlreadyTriggeredBetweenFromDate"] as? Double
          let skipIfAlreadyTriggeredBetweenToDate =
            action["skipIfAlreadyTriggeredBetweenToDate"] as? Double

          let skipIfWhitelistOrBlacklistIsUnchanged =
            action["skipIfWhitelistOrBlacklistIsUnchanged"] as? Bool

          if shouldExecuteAction(
            skipIfAlreadyTriggeredAfter: skipIfAlreadyTriggeredAfter,
            skipIfLargerEventRecordedAfter: skipIfLargerEventRecordedAfter,
            skipIfAlreadyTriggeredWithinMS: skipIfAlreadyTriggeredWithinMS,
            skipIfLargerEventRecordedWithinMS: skipIfLargerEventRecordedWithinMS,
            neverTriggerBefore: neverTriggerBefore,
            skipIfLargerEventRecordedSinceIntervalStarted:
              skipIfLargerEventRecordedSinceIntervalStarted,
            skipIfAlreadyTriggeredBefore: skipIfAlreadyTriggeredBefore,
            skipIfAlreadyTriggeredBetweenFromDate: skipIfAlreadyTriggeredBetweenFromDate,
            skipIfAlreadyTriggeredBetweenToDate: skipIfAlreadyTriggeredBetweenToDate,
            skipIfWhitelistOrBlacklistIsUnchanged: skipIfWhitelistOrBlacklistIsUnchanged,
            originalWhitelist: originalWhitelist,
            originalBlocklist: originalBlocklist,
            activityName: activityName,
            callbackName: callbackName,
            eventName: eventName
          ) {
            executeGenericAction(
              action: action,
              placeholders: placeholders,
              triggeredBy: triggeredBy
            )
          }
        }
      }
    }
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name, activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    logger.log("eventDidReachThreshold: \(event.rawValue, privacy: .public)")

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "eventDidReachThreshold",
      eventName: event.rawValue
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "eventDidReachThreshold",
      eventName: event.rawValue
    )

    notifyAppWithName(name: "eventDidReachThreshold")
  }

  override func intervalWillStartWarning(for activity: DeviceActivityName) {
    super.intervalWillStartWarning(for: activity)
    logger.log("intervalWillStartWarning")

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "intervalWillStartWarning",
      eventName: nil
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "intervalWillStartWarning"
    )

    notifyAppWithName(name: "intervalWillStartWarning")
  }

  override func intervalWillEndWarning(for activity: DeviceActivityName) {
    super.intervalWillEndWarning(for: activity)
    logger.log("intervalWillEndWarning")

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "intervalWillEndWarning",
      eventName: nil
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "intervalWillEndWarning"
    )

    notifyAppWithName(name: "intervalWillEndWarning")
  }

  override func eventWillReachThresholdWarning(
    _ event: DeviceActivityEvent.Name, activity: DeviceActivityName
  ) {
    super.eventWillReachThresholdWarning(event, activity: activity)
    logger.log("eventWillReachThresholdWarning: \(event.rawValue, privacy: .public)")

    self.executeActionsForEvent(
      activityName: activity.rawValue,
      callbackName: "eventWillReachThresholdWarning",
      eventName: event.rawValue
    )

    persistToUserDefaults(
      activityName: activity.rawValue,
      callbackName: "eventWillReachThresholdWarning",
      eventName: event.rawValue
    )

    notifyAppWithName(name: "eventWillReachThresholdWarning")
  }

}
