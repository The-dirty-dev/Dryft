using UnityEngine;
using System;
using System.Collections.Generic;

namespace Drift.Core
{
    /// <summary>
    /// Manages memory usage and provides utilities for optimization.
    /// </summary>
    public class MemoryManager : MonoBehaviour
    {
        public static MemoryManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float memoryCheckIntervalSeconds = 30f;
        [SerializeField] private float warningThresholdMB = 512f;
        [SerializeField] private float criticalThresholdMB = 768f;
        [SerializeField] private bool autoGCOnCritical = true;

        [Header("Object Pooling")]
        [SerializeField] private int defaultPoolSize = 10;
        [SerializeField] private int maxPoolSize = 50;

        // Events
        public event Action<float> OnMemoryWarning;
        public event Action<float> OnMemoryCritical;
        public event Action OnMemoryRecovered;

        // State
        public float CurrentMemoryMB { get; private set; }
        public MemoryState CurrentState { get; private set; } = MemoryState.Normal;

        private float _lastMemoryCheck;
        private Dictionary<Type, Queue<Component>> _objectPools = new Dictionary<Type, Queue<Component>>();
        private Dictionary<string, AssetBundle> _loadedBundles = new Dictionary<string, AssetBundle>();

        public enum MemoryState
        {
            Normal,
            Warning,
            Critical
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            if (Time.time - _lastMemoryCheck >= memoryCheckIntervalSeconds)
            {
                _lastMemoryCheck = Time.time;
                CheckMemory();
            }
        }

        // =======================================================================
        // Memory Monitoring
        // =======================================================================

        private void CheckMemory()
        {
            // Get total allocated memory
            long totalMemory = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
            CurrentMemoryMB = totalMemory / (1024f * 1024f);

            MemoryState previousState = CurrentState;

            if (CurrentMemoryMB >= criticalThresholdMB)
            {
                CurrentState = MemoryState.Critical;
                Debug.LogWarning($"[MemoryManager] CRITICAL: {CurrentMemoryMB:F1}MB allocated");
                OnMemoryCritical?.Invoke(CurrentMemoryMB);

                if (autoGCOnCritical)
                {
                    ForceGarbageCollection();
                }
            }
            else if (CurrentMemoryMB >= warningThresholdMB)
            {
                CurrentState = MemoryState.Warning;
                Debug.LogWarning($"[MemoryManager] Warning: {CurrentMemoryMB:F1}MB allocated");
                OnMemoryWarning?.Invoke(CurrentMemoryMB);
            }
            else
            {
                CurrentState = MemoryState.Normal;

                if (previousState != MemoryState.Normal)
                {
                    Debug.Log($"[MemoryManager] Memory recovered: {CurrentMemoryMB:F1}MB");
                    OnMemoryRecovered?.Invoke();
                }
            }
        }

        /// <summary>
        /// Forces garbage collection.
        /// </summary>
        public void ForceGarbageCollection()
        {
            Debug.Log("[MemoryManager] Forcing garbage collection...");

            // Unload unused assets
            Resources.UnloadUnusedAssets();

            // Force GC
            System.GC.Collect();
            System.GC.WaitForPendingFinalizers();
            System.GC.Collect();

            Debug.Log($"[MemoryManager] GC complete. Memory: {CurrentMemoryMB:F1}MB");
        }

        // =======================================================================
        // Object Pooling
        // =======================================================================

        /// <summary>
        /// Gets or creates an object from the pool.
        /// </summary>
        public T GetFromPool<T>(T prefab, Transform parent = null) where T : Component
        {
            Type type = typeof(T);

            if (!_objectPools.TryGetValue(type, out var pool))
            {
                pool = new Queue<Component>();
                _objectPools[type] = pool;
            }

            T obj;
            if (pool.Count > 0)
            {
                obj = pool.Dequeue() as T;
                if (obj != null)
                {
                    obj.transform.SetParent(parent);
                    obj.gameObject.SetActive(true);
                    return obj;
                }
            }

            // Create new instance
            obj = Instantiate(prefab, parent);
            return obj;
        }

        /// <summary>
        /// Returns an object to the pool.
        /// </summary>
        public void ReturnToPool<T>(T obj) where T : Component
        {
            if (obj == null) return;

            Type type = typeof(T);

            if (!_objectPools.TryGetValue(type, out var pool))
            {
                pool = new Queue<Component>();
                _objectPools[type] = pool;
            }

            if (pool.Count >= maxPoolSize)
            {
                // Pool is full, destroy the object
                Destroy(obj.gameObject);
                return;
            }

            obj.gameObject.SetActive(false);
            obj.transform.SetParent(transform); // Parent to manager to prevent scene unload issues
            pool.Enqueue(obj);
        }

        /// <summary>
        /// Clears all object pools.
        /// </summary>
        public void ClearPools()
        {
            foreach (var pool in _objectPools.Values)
            {
                while (pool.Count > 0)
                {
                    var obj = pool.Dequeue();
                    if (obj != null)
                    {
                        Destroy(obj.gameObject);
                    }
                }
            }
            _objectPools.Clear();
        }

        /// <summary>
        /// Pre-warms a pool with instances.
        /// </summary>
        public void PrewarmPool<T>(T prefab, int count) where T : Component
        {
            for (int i = 0; i < count; i++)
            {
                var obj = Instantiate(prefab, transform);
                obj.gameObject.SetActive(false);
                ReturnToPool(obj);
            }
        }

        // =======================================================================
        // Asset Bundle Management
        // =======================================================================

        /// <summary>
        /// Loads an asset bundle with caching.
        /// </summary>
        public AssetBundle LoadBundle(string bundleName, byte[] bundleData)
        {
            if (_loadedBundles.TryGetValue(bundleName, out var existing))
            {
                return existing;
            }

            var bundle = AssetBundle.LoadFromMemory(bundleData);
            if (bundle != null)
            {
                _loadedBundles[bundleName] = bundle;
            }
            return bundle;
        }

        /// <summary>
        /// Unloads an asset bundle.
        /// </summary>
        public void UnloadBundle(string bundleName, bool unloadAllLoadedObjects = true)
        {
            if (_loadedBundles.TryGetValue(bundleName, out var bundle))
            {
                bundle.Unload(unloadAllLoadedObjects);
                _loadedBundles.Remove(bundleName);
            }
        }

        /// <summary>
        /// Unloads all asset bundles.
        /// </summary>
        public void UnloadAllBundles(bool unloadAllLoadedObjects = true)
        {
            foreach (var bundle in _loadedBundles.Values)
            {
                bundle.Unload(unloadAllLoadedObjects);
            }
            _loadedBundles.Clear();
        }

        /// <summary>
        /// Unloads least recently used bundles to free memory.
        /// </summary>
        public void TrimBundles(int keepCount)
        {
            if (_loadedBundles.Count <= keepCount) return;

            var bundlesToRemove = new List<string>();
            int removeCount = _loadedBundles.Count - keepCount;

            foreach (var key in _loadedBundles.Keys)
            {
                if (bundlesToRemove.Count >= removeCount) break;
                bundlesToRemove.Add(key);
            }

            foreach (var bundleName in bundlesToRemove)
            {
                UnloadBundle(bundleName, true);
            }
        }

        // =======================================================================
        // Texture Management
        // =======================================================================

        /// <summary>
        /// Reduces texture quality when memory is low.
        /// </summary>
        public void ReduceTextureQuality()
        {
            QualitySettings.globalTextureMipmapLimit = Mathf.Min(
                QualitySettings.globalTextureMipmapLimit + 1,
                3
            );
            Debug.Log($"[MemoryManager] Reduced texture quality to mipmap level {QualitySettings.globalTextureMipmapLimit}");
        }

        /// <summary>
        /// Restores texture quality to default.
        /// </summary>
        public void RestoreTextureQuality()
        {
            QualitySettings.globalTextureMipmapLimit = 0;
            Debug.Log("[MemoryManager] Restored texture quality");
        }

        // =======================================================================
        // Cleanup
        // =======================================================================

        private void OnDestroy()
        {
            ClearPools();
            UnloadAllBundles();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // App paused - good time to clean up
                ForceGarbageCollection();
            }
        }
    }
}
