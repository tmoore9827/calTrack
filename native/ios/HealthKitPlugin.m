/**
 * Objective-C bridge for the HealthKit Capacitor plugin.
 * Required for Capacitor to discover the Swift plugin class.
 *
 * Copy this file alongside HealthKitPlugin.swift into ios/App/App/
 */

#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthKitPlugin, "HealthKit",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getRunningWorkouts, CAPPluginReturnPromise);
)
