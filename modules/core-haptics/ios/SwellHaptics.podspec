require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Pod is named SwellHaptics (not "CoreHaptics") to avoid clashing with Apple's
# system CoreHaptics framework that this module links against.
Pod::Spec.new do |s|
  s.name           = 'SwellHaptics'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://donothing.local'
  s.platforms      = { :ios => '15.0' }
  s.swift_version  = '5.8'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreHaptics'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
