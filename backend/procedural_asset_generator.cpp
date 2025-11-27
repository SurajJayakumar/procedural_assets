// MyProceduralTool.cpp

// --- REQUIRED IMPORTS ---
// #include "MyProceduralTool.h"
// #include "Engine/World.h"
// #include "Components/HierarchicalInstancedStaticMeshComponent.h"
// #include "DrawDebugHelpers.h"
// #include "ScopedTransaction.h"
// #include "Async/Async.h"
//#include "crow.h"
#include <mutex>
#include <unordered_map>

// --- MEMORY TRACKER (From your Spec) ---
struct FAllocationInfo {
    size_t Size;
    // uint64 Timestamp; 
};

class FDebugAllocator {
public:
    static FDebugAllocator& Get() {
        static FDebugAllocator Instance;
        return Instance;
    }

    void* Malloc(size_t Size) {
        void* Ptr = FMemory::Malloc(Size); // Use Unreal's FMemory
        
        std::lock_guard<std::mutex> Lock(AllocationMutex);
        Allocations[Ptr] = { Size };
        TotalAllocated += Size;

        // In a real app, Broadcast this via WebSocket here
        // BroadcastToFrontend("ALLOC", Size);
        
        return Ptr;
    }

    void Free(void* Ptr) {
        {
            std::lock_guard<std::mutex> Lock(AllocationMutex);
            if (Allocations.find(Ptr) != Allocations.end()) {
                TotalAllocated -= Allocations[Ptr].Size;
                Allocations.erase(Ptr);
            }
        }
        FMemory::Free(Ptr);
    }

    size_t GetTotalUsage() {
        std::lock_guard<std::mutex> Lock(AllocationMutex);
        return TotalAllocated;
    }

private:
    std::mutex AllocationMutex;
    std::unordered_map<void*, FAllocationInfo> Allocations;
    size_t TotalAllocated = 0;
};

// --- MAIN PLUGIN LOGIC ---

void UProceduralToolSubsystem::PaintFoliage(UWorld* World, FVector Center, float Radius, int32 Density, float MaxSlopeAngle, bool bEnableClustering)
{
    if (!World) return;

    FScopedTransaction Transaction(FText::FromString("Paint Foliage"));
    
    // Simulate a large allocation for the tool's operation to show up in the profiler
    void* TempBuffer = FDebugAllocator::Get().Malloc(1024 * 1024 * 5); // 5MB Fake Alloc

    UHierarchicalInstancedStaticMeshComponent* HISMC = GetFoliageComponent(World);
    HISMC->Modify();

    int32 SpawnedCount = 0;

    for (int32 i = 0; i < Density; i++)
    {
        // --- 1. BIOLOGICAL CLUSTERING (New Feature) ---
        // Instead of pure random, we can bias towards existing neighbors to simulate root systems
        FVector2D Offset;
        if (bEnableClustering && SpawnedCount > 0 && FMath::RandBool()) {
             // Cluster logic: Pick a random point near the *previous* success
             Offset = LastSuccessOffset + FMath::RandPointInCircle(Radius * 0.2f);
        } else {
             // Standard logic: Random point in full brush
             Offset = FMath::RandPointInCircle(Radius);
        }

        FVector Start = Center + FVector(Offset.X, Offset.Y, 1000);
        FVector End   = Center + FVector(Offset.X, Offset.Y, -1000);

        FHitResult Hit;
        if (World->LineTraceSingleByChannel(Hit, Start, End, ECC_WorldStatic))
        {
            // --- 2. SLOPE LOGIC ---
            // Calculate angle between Hit Normal and Up Vector (0,0,1)
            // Dot Product of 1.0 = 0 degrees (flat). Dot Product of 0.0 = 90 degrees (wall).
            float DotP = FVector::DotProduct(Hit.ImpactNormal, FVector::UpVector);
            float AngleDeg = FMath::RadiansToDegrees(FMath::Acos(DotP));

            if (AngleDeg > MaxSlopeAngle) {
                continue; // Too steep!
            }

            // --- 3. SPAWN ---
            FTransform T;
            T.SetLocation(Hit.Location);
            T.SetRotation(FRotator(0, FMath::RandRange(0, 360), 0).Quaternion());
            T.SetScale3D(FVector(FMath::RandRange(0.8f, 1.2f)));
            
            HISMC->AddInstance(T, true);
            
            LastSuccessOffset = Offset;
            SpawnedCount++;
        }
    }

    // Clean up memory after operation
    FDebugAllocator::Get().Free(TempBuffer);
}



void StartWebServer() {
    crow::SimpleApp app;

    // Define a route (Endpoint) - Just like @app.get("/") in Python
    CROW_ROUTE(app, "/memory_stats")([](){
        size_t Usage = FDebugAllocator::Get().GetTotalUsage();
        crow::json::wvalue x;
        x["usage_bytes"] = Usage;
        x["status"] = "OK";
        return x;
    });

    CROW_ROUTE(app, "/paint").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto x = crow::json::load(req.body);
        if (!x) return crow::response(400);
        
        // Dispatch to Main Thread (Unreal requirement)
        AsyncTask(ENamedThreads::GameThread, [x](){
             UProceduralToolSubsystem::PaintFoliage(
                 x["x"].d(), x["y"].d(), ...
             );
        });

        return crow::response(200);
    });

    // Run on port 8080
    app.port(8080).multithreaded().run();
}
