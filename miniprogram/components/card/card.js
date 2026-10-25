Component({ options: { styleIsolation: 'apply-shared', multipleSlots: true }, properties: { pad: { type: Boolean, value: true }, tappable: Boolean },
  methods: { onTap() { if (this.data.tappable) this.triggerEvent('press'); } } });
