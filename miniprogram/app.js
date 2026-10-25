const repo = require('./utils/repo/index');
App({
  onLaunch() {
    if (wx.cloud) wx.cloud.init({ env: 'cloud1-d8gn4xfqredd566d1', traceUser: false });
    const st = repo.init();
    this.globalData.repoStatus = st;
    // Friendly texts only; raw exception text is never shown (QA Q16).
    if (st.mode === 'readonly') wx.showModal({ title: st.schemaVersion ? '请更新小程序' : '只读模式', content: st.message, showCancel: false });
    else if (st.mode === 'error') wx.showModal({ title: '数据加载失败', content: (st.error && st.error.message) || '数据初始化失败', showCancel: false });
    else if (st.mode === 'corrupt') wx.showModal({ title: '部分数据读取异常', content: '为保护原数据，已暂停对这部分数据的保存。可在页面顶部点「重新加载」重试。', showCancel: false });
  },
  globalData: { repoStatus: null },
});
