/*const { renovarAccessToken } = require('./blingService');
const axios = require('axios');
require('dotenv').config();

renovarAccessToken().then(token => {
  axios.post('https://hook.us2.make.com/hce28beph3r90wvy9f1t0uai1pgf85', {
    access_token: token,
    refresh_token: process.env.BLING_REFRESH_TOKEN
  }).then(() => {
    console.log('✅ Tokens enviados ao Make com sucesso.');
  }).catch(err => {
    console.error('❌ Erro ao enviar para o Make:', err.response?.data || err.message);
  });
}).catch(error => {
  console.error('❌ Erro ao renovar token:', error.message);
});
*/
