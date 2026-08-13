export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export%20default%20%7B%7D"
    }
  }
  return nextResolve(specifier, context)
}
