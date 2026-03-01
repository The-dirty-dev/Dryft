# Dryft VR (Unity)

This directory contains the Unity project for Dryft’s VR experience (Quest and PC VR). It integrates realtime networking (Normcore), avatar sync, haptics, and the neon bar environment.

## Requirements

- **Unity**: 2022.3 LTS or later (with Android Build Support)
- **XR**: XR Plugin Management + Oculus XR Plugin (Quest)
- **Packages**: Normcore via scoped registry (see `Packages/manifest.json`)

The Unity setup wizard is available at `Dryft/Setup Guide` in the editor.

## Opening the Project

1. Open Unity Hub and add the `vr-dryft/` folder.
2. Ensure you are using Unity 2022.3 LTS+.
3. Open the project and run the `Dryft/Setup Guide` for quick validation.

## Build Targets

- **Quest (Android)**: Default build target for on‑device testing.
- **PC VR (Windows)**: For tethered or desktop testing.

For Quest builds, enable Developer Mode on the headset and use SideQuest for sideloading.

## Script Architecture

Scripts live under `Assets/Scripts/` and are organized by domain. Current layout includes 15+ directories such as:

- `Auth`, `Networking`, `API` – authentication and backend integrations
- `Haptics`, `Voice`, `Safety`, `Verification` – realtime device and safety features
- `Avatar`, `Environment`, `Interaction`, `Player` – in‑world logic and controls
- `UI`, `Settings`, `Accessibility`, `Localization` – UX and configuration

There are currently 70+ scripts across ~19 subdirectories. If you add or move scripts, please update this README.

## Tests (EditMode)

EditMode tests live under `Assets/Tests/EditMode/`.

To run them:
1. Open Unity Test Runner (Window → General → Test Runner).
2. Select **EditMode**.
3. Run tests such as `VoiceChatTests`, `AvatarSyncTests`, and `SafetyTests`.

## Shaders

The neon bar look is driven by `Assets/Shaders/NeonGlow.shader`. This shader is the basis for the low‑fi neon lighting aesthetic described in the product vision.

## Normcore

Normcore is included via a scoped registry in `Packages/manifest.json` and provides the multiplayer synchronization layer for shared spaces and sessions.

## SideQuest Sideloading (Quest)

The VR app is distributed outside the official stores. Use SideQuest to sideload builds onto Meta Quest devices during development and testing.
