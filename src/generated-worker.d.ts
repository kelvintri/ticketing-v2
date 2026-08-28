declare module "*cloudflare/_worker.js" {
  const worker: {
    fetch(request: Request, env: Record<string, unknown>, context: ExecutionContext): Promise<Response>;
  };
  export default worker;
}
