export default {
  async fetch(request, env) {
    const key = env.HOLDED_API_KEY || 'VACIA';
    return new Response('KEY:' + key.substring(0, 10));
  }
};
 
