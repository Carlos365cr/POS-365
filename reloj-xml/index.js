export default {
  async scheduled(event, env) {
    const response = await fetch('https://facturacion-cedi.pages.dev/api/reloj-xml', {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + env.POS365_SYNC_TRIGGER }
    });
    if (response.status !== 204) throw Error('Falló la revisión programada de XML (' + response.status + ').');
  }
};
