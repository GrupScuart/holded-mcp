export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === '/mcp') {
      if (request.method === 'GET') {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        writer.write(encoder.encode('data: ' + JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized',params:{}}) + '\n\n'));
        writer.close();
        return new Response(readable, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
        });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const result = await handleMCP(body, env.HOLDED_API_KEY);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response('Holded MCP Server OK', { status: 200, headers: corsHeaders });
  }
};
async function handleMCP(body, apiKey) {
  const { id, method, params } = body;
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'holded-mcp', version: '1.0.0' } } };
  }
  if (method === 'notifications/initialized') { return { jsonrpc: '2.0', id, result: {} }; }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: [
      { name: 'holded_get_invoices', description: 'Obtiene facturas de venta de Holded', inputSchema: { type: 'object', properties: { page: { type: 'number' } } } },
      { name: 'holded_get_contacts', description: 'Obtiene contactos de Holded', inputSchema: { type: 'object', properties: { page: { type: 'number' } } } },
      { name: 'holded_get_warehouses', description: 'Obtiene proyectos y almacenes de Holded', inputSchema: { type: 'object', properties: {} } },
      { name: 'holded_get_accounting', description: 'Obtiene asientos contables de Holded', inputSchema: { type: 'object', properties: { page: { type: 'number' } } } },
      { name: 'holded_get_expenses', description: 'Obtiene facturas de compra de Holded', inputSchema: { type: 'object', properties: { page: { type: 'number' } } } }
    ]}};
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    const data = await executeTool(name, args || {}, apiKey);
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } };
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Metodo no encontrado' } };
}
async function executeTool(name, args, apiKey) {
  const base = 'https://api.holded.com/api';
  const headers = { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
  let endpoint;
  switch (name) {
    case 'holded_get_invoices': endpoint = '/invoicing/v1/documents/invoice?page=' + (args.page || 1); break;
    case 'holded_get_contacts': endpoint = '/crm/v1/contacts?page=' + (args.page || 1); break;
    case 'holded_get_warehouses': endpoint = '/warehouse/v1/warehouses'; break;
    case 'holded_get_accounting': endpoint = '/accounting/v1/dailyledger?page=' + (args.page || 1); break;
    case 'holded_get_expenses': endpoint = '/invoicing/v1/documents/purchase?page=' + (args.page || 1); break;
    default: return { error: 'Herramienta desconocida: ' + name };
  }
  try {
    const res = await fetch(base + endpoint, { method: 'GET', headers });
    return await res.json();
  } catch (err) { return { error: err.message }; }
}
