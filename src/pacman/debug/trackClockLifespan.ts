// Registers a cleanup callback that logs to the console when a tracked object is garbage collected
const clockGarbageRegistry = new FinalizationRegistry((heldValue) => {
  console.log(`GARBAGE COLLECTOR: Old ${heldValue} was successfully recycled!`);
});

/**
 * Links an object instance to the finalization registry to monitor when it is cleared from memory.
 * @param clockInstance - The target object instance to monitor
 * @param label - A descriptive string name used to identify the object in the logs
 */
export function trackClockLifespan(clockInstance: any, label: string) {
  // Pass the instance to monitor and the identifier label to the registry
  clockGarbageRegistry.register(clockInstance, label);
}
