/**
 * Capacitor plugin for reading Apple Health running workouts.
 *
 * SETUP: After running `npx cap add ios`, copy this file and
 * HealthKitPlugin.m into ios/App/App/ and add to the Xcode project.
 *
 * Also add these to Info.plist:
 *   NSHealthShareUsageDescription: "calTrack reads your workouts to track running progress"
 *
 * And enable HealthKit capability in Xcode:
 *   Signing & Capabilities → + Capability → HealthKit
 */

import Foundation
import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRunningWorkouts", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    // MARK: - requestAuthorization

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }

        let readTypes: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]

        healthStore.requestAuthorization(toShare: nil, read: readTypes) { success, error in
            call.resolve(["granted": success])
        }
    }

    // MARK: - getRunningWorkouts

    @objc func getRunningWorkouts(_ call: CAPPluginCall) {
        guard let startStr = call.getString("startDate"),
              let endStr = call.getString("endDate") else {
            call.reject("Missing startDate or endDate")
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let startDate = formatter.date(from: startStr),
              let endDate = formatter.date(from: endStr) else {
            call.reject("Invalid date format")
            return
        }

        let runningPredicate = HKQuery.predicateForWorkouts(with: .running)
        let datePredicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        let compound = NSCompoundPredicate(andPredicateWithSubpredicates: [
            runningPredicate, datePredicate
        ])

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        let query = HKSampleQuery(
            sampleType: .workoutType(),
            predicate: compound,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sortDescriptor]
        ) { [weak self] _, samples, error in
            guard let workouts = samples as? [HKWorkout] else {
                call.resolve(["workouts": []])
                return
            }

            let results = workouts.map { workout -> [String: Any] in
                let distanceMeters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
                let distanceMiles = distanceMeters / 1609.344
                let durationMinutes = workout.duration / 60.0
                let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0

                return [
                    "uuid": workout.uuid.uuidString,
                    "startDate": formatter.string(from: workout.startDate),
                    "endDate": formatter.string(from: workout.endDate),
                    "distanceMiles": round(distanceMiles * 100) / 100,
                    "durationMinutes": round(durationMinutes * 10) / 10,
                    "calories": round(calories),
                    "avgHeartRate": NSNull(),  // Requires separate statistics query
                    "elevationGain": NSNull(), // Requires metadata query
                    "activityType": "running",
                ]
            }

            call.resolve(["workouts": results])
        }

        healthStore.execute(query)
    }
}
