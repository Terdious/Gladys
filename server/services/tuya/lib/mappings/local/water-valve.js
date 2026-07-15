// DP ids observed on the "Valve Controller" (wt_wifi_v2) shadow/thing model.
// `strict` opts out of the generic `_N` suffix inference: the internal DPs must
// never generate phantom local features. The ignored list mirrors the cloud
// mapping: firmware plumbing only (mfg_model 105, support_features 116,
// unix_time 119, log server 120/121, dev_token 122, soft_ver 129, dev_state 130,
// app_features 131); functional DPs stay unknown so they remain requestable.
module.exports = {
  strict: true,
  ignoredDps: ['105', '116', '119', '120', '121', '122', '129', '130', '131'],
  codeAliases: {},
  dps: {
    switch: 1,
    battery_percentage: 7,
    valve_status: 117,
  },
};
