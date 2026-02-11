// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Tunnels2Bots",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "Tunnels2Bots",
            targets: ["Tunnels2Bots"])
    ],
    targets: [
        .target(
            name: "Tunnels2Bots",
            dependencies: [],
            path: "Sources",
            sources: ["Tunnels2Bots.swift", "WebSocketClient.swift", "Models.swift"]),
        .testTarget(
            name: "Tunnels2BotsTests",
            dependencies: ["Tunnels2Bots"],
            path: "Tests")
    ],
    swiftLanguageVersions: [.v5]
)