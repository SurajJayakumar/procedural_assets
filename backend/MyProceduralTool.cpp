// #include "Engine/World.h"
// #include "Components/InstancedStaticMeshComponent.h"

void FAssetPlacementMode::PaintAssets(UWorld* World, FVector HitLocation, float BrushRadius) {
    // 1. Define rules (simplified)
    int32 ItemsToSpawn = 5; 
    float MinScale = 0.8f;
    float MaxScale = 1.2f;

    // 2. Get the ISMC (assuming one exists on a manager actor)
    // AInstancedMeshManager* Manager = ...;
    // UInstancedStaticMeshComponent* ISMC = Manager->GetISMC();

    GEditor->BeginTransaction(FText::FromString("Paint Assets"));
    // ISMC->Modify(); // Save state for Undo

    for (int32 i = 0; i < ItemsToSpawn; i++) {
        // 3. Random point in circle
        FVector2D RandomOffset = FMath::RandPointInCircle(BrushRadius);
        FVector SpawnLocation = HitLocation + FVector(RandomOffset.X, RandomOffset.Y, 0);

        // 4. Line trace down to find ground Z
        FHitResult GroundHit;
        FVector TraceStart = SpawnLocation + FVector(0, 0, 500);
        FVector TraceEnd = SpawnLocation - FVector(0, 0, 500);
        
        if (World->LineTraceSingleByChannel(GroundHit, TraceStart, TraceEnd, ECC_WorldStatic)) {
            // 5. Apply Random Transform
            FTransform SpawnTransform;
            SpawnTransform.SetLocation(GroundHit.Location);
            
            float RandomScale = FMath::RandRange(MinScale, MaxScale);
            SpawnTransform.SetScale3D(FVector(RandomScale));

            FRotator RandomRotation(0, FMath::RandRange(0.0f, 360.0f), 0);
            SpawnTransform.SetRotation(RandomRotation.Quaternion());

            // 6. Add Instance
             ISMC->AddInstance(SpawnTransform);
        }
    }

    GEditor->EndTransaction();
}