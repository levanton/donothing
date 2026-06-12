require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Pod is named SessionTorch (not "Torch") to avoid any clash with other pods.
Pod::Spec.new do |s|
  s.name           = 'SessionTorch'
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
  s.frameworks = 'AVFoundation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
