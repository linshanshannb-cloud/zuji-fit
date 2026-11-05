// Remote 180×180 GIFs from Devillmy/exercises-dataset-zh (media © Gym visual).
// Not bundled. Detail page only. Production needs downloadFile 合法域名 cdn.jsdelivr.net.
const COMMIT = 'c335dbc6c9f21d70e585ebffec2481496c059b92';
const BASE = 'https://cdn.jsdelivr.net/gh/Devillmy/exercises-dataset-zh@' + COMMIT;

function gifUrl(id, mediaId) {
  return BASE + '/videos/' + id + '-' + mediaId + '.gif';
}

module.exports = { COMMIT, BASE, gifUrl };
