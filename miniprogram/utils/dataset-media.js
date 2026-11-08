// 数据集封面 JPEG 与详情 GIF 在当前云开发环境，不打进安装包。
// fileID 与 anim/*.mp4 同一环境 cloud1-d8gn4xfqredd566d1，不写死临时 https 域名。
// 列表和详情的 <image> 直接使用 cloud://，基础库会换成临时地址。
// 已有 mp4 仍由详情页用 wx.cloud.getTempFileURL 播放，这里不生成视频地址。
const CLOUD_ROOT = 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/';

function fileId(folder, id, mediaId, ext) {
  if (!id || !mediaId) return '';
  return CLOUD_ROOT + folder + '/' + id + '-' + mediaId + '.' + ext;
}

function thumbUrl(id, mediaId) {
  return fileId('images', id, mediaId, 'jpg');
}

function gifUrl(id, mediaId) {
  return fileId('videos', id, mediaId, 'gif');
}

module.exports = { CLOUD_ROOT, thumbUrl, gifUrl };
