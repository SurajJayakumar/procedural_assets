#pragma once

#include "CoreMinimal.h"
#include "Editor/EditorSubsystem.h"
#include "Engine/World.h"
#include "MyProceduralTool.generated.h"

/**
 * UProceduralToolSubsystem
 * * This class acts as the bridge between your React Frontend (via Web Remote Control)
 * and the Unreal Engine Editor world.
 * * It manages the lifecycle of the tool, handles undo/redo transactions,
 * and executes the actual asset spawning logic.
 */
UCLASS()
class MYGAME_API UProceduralToolSubsystem : public UEditorSubsystem
{
    GENERATED_BODY()

public:
    // --- API EXPOSED TO FRONTEND ---

    /** * Main entry point called by the HTTP/Crow server or Web Remote Control.
     * * @param WorldContext - The world to paint in (usually GEditor->GetEditorWorldContext().World())
     * @param CenterLocation - The [X, Y, Z] world coordinate where the brush clicked
     * @param Radius - The size of the brush in unreal units
     * @param Density - How many items to attempt spawning
     * @param MaxSlopeAngle - The maximum angle (0-90) allowed for spawning
     * @param bEnableClustering - Whether to group assets biologically
     */
    UFUNCTION(BlueprintCallable, Category = "Procedural Tool")
    void PaintFoliage(UWorld* World, FVector CenterLocation, float Radius, int32 Density, float MaxSlopeAngle, bool bEnableClustering);

    // --- UTILITIES ---

    /** Clears all assets placed by this tool (Found via Tags) */
    UFUNCTION(BlueprintCallable, Category = "Procedural Tool")
    void ClearAllFoliage(UWorld* World);

private:
    /** * Helper to find or create the HierarchicalInstancedStaticMeshComponent (HISMC)
     * which allows rendering thousands of meshes efficiently with one draw call.
     */
    class UHierarchicalInstancedStaticMeshComponent* GetFoliageComponent(UWorld* World);

    // Internal tracker for biological clustering offset
    FVector2D LastSuccessOffset;
};