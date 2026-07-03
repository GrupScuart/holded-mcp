export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    const url = new URL(request.url);
    if (url.pathname === '/mcp') {
      const body = await request.json();
      return handleMCP(body, env.HOLDED_API_KEY);
    }
    return new Response('Holded MCP Server OK', { status: 200 });
  }
};

async function handleMCP(body, apiKey) {
  const { method, params } = body;
  if (method === 'initialize') {
    return jsonResponse({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'holded-mcp', version: '1.0.0' }
    });
  }
  if (method === 'tools/list') {
    return jsonResponse({
      tools: [
        {
          name: 'holded_get_invoices',
          description: 'Obtiene facturas de Holded',
          inputSchema: { type: 'object', properties: { page: { type: 'number' } } }
        },
        {
          name: 'holded_get_contacts',
          description: 'Obtiene contactos de Holded',
          inputSchema: { type: 'object', properties: { page: { type: 'number' } } }
        },
        {
          name: 'holded_get_warehouses',
          description: 'Obtiene proyectos y almacenes de Holded',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'holded_get_accounting',
          description: 'Obtiene asientos contables de Holded',
          inputSchema: { type: 'object', properties: { page: { type: 'number' } } }
        },
        {
          name: 'holded_get_expenses',
          description: 'Obtiene facturas de compra de Holded',
          inputSchema: { type: 'object', properties: { page: { type: 'number' } } }
        }
      ]
    });
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    return await executeTool(name, args, apiKey);
  }
  return jsonResponse({ error: 'Metodo no soportado' }, 400);
}

async function executeTool(name, args, apiKey) {
  const base = 'https://api.holded.com/api';
  const headers = { 'key': apiKey, 'Content-Type': 'application/json' };
  let endpoint, method = 'GET';
  switch (name) {
    case 'holded_get_invoices':
      endpoint = '/invoicing/v1/documents/invoice?page=' + (args.page || 1);
      break;
    case 'holded_get_contacts':
      endpoint = '/crm/v1/contacts?page=' + (args.page || 1);
      break;
    case 'holded_get_warehouses':
      endpoint = '/warehouse/v1/warehouses';
      break;
    case 'holded_get_accounting':
      endpoint = '/accounting/v1/dailyledger?page=' + (args.page || 1);
      break;
    case 'holded_get_expenses':
      endpoint = '/invoicing/v1/documents/purchase?page=' + (args.page || 1);
      break;
    default:
      return jsonResponse({ error: 'Herramienta desconocida: ' + name }, 400);
  }
  try {
    const res = await fetch(base + endpoint, { method, headers });
    const data = await res.json();
    return jsonResponse({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
  } catch (err) {
    return jsonResponse({ content: [{ type: 'text', text: 'Error: ' + err.message }] });
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
