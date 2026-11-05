// Remote 180×180 stills and GIFs from Devillmy/exercises-dataset-zh (media © Gym visual).
// Not bundled. List cards use the JPEG still; the detail page can play the GIF.
// Production needs downloadFile 合法域名 cdn.jsdelivr.net. Dev tools have urlCheck off.
const COMMIT = 'c335dbc6c9f21d70e585ebffec2481496c059b92';
const BASE = 'https://cdn.jsdelivr.net/gh/Devillmy/exercises-dataset-zh@' + COMMIT;

function thumbUrl(id, mediaId) {
  return BASE + '/images/' + id + '-' + mediaId + '.jpg';
}
function gifUrl(id, mediaId) {
  return BASE + '/videos/' + id + '-' + mediaId + '.gif';
}

module.exports = { COMMIT, BASE, thumbUrl, gifUrl };
