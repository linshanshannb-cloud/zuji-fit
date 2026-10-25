// type: primary | secondary | ghost | danger | text ; size: bar | page
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: { type: { type: String, value: 'primary' }, size: { type: String, value: 'page' }, disabled: Boolean, loading: Boolean, block: { type: Boolean, value: true } },
  methods: { onTap() { if (this.data.disabled || this.data.loading) { this.triggerEvent('disabledtap'); return; } this.triggerEvent('press'); } },
});
