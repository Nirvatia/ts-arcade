// Create a registry that logs to the console when an object dies
const clockGarbageRegistry = new FinalizationRegistry((heldValue) => {
  console.log(`♻️ GARBAGE COLLECTOR: Old ${heldValue} was successfully recycled!`);
});

// Helper function to attach a clock to the tracker
export function trackClockLifespan(clockInstance: any, label: string) {
  // We register the clock instance. 
  // When it's destroyed, the registry passes the label string to the callback.
  clockGarbageRegistry.register(clockInstance, label);
}