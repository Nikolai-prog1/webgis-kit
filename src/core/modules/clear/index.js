export default {
  id: 'clear',
  kind: 'tool',
  setup(ctx) {
    ctx.ui.toolbar.registerTool({
      id: 'clear',
      icon: 'ti-eraser',
      exclusive: false,
      onActivate() {
        ctx.tools.deactivate();
        ctx.ui.toolbar.close();
        ctx.hooks.emit('map:clear', {});
        ctx.ui.popup.close();
      },
    });
  },
};
