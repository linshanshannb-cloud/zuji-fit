Component({ options: { styleIsolation: 'apply-shared' }, properties: { title: String, sub: String, action: String, compact: Boolean },
  methods: { onAction() { this.triggerEvent('action'); } } });
