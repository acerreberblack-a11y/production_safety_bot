export default () => async (ctx, next) => {
  const wrap = (target, method) => {
    const original = target[method];
    if (typeof original !== 'function') return;
    const bound = original.bind(target);
    // eslint-disable-next-line no-param-reassign
    target[method] = (...args) => {
      const callArgs = [...args];
      const last = callArgs[callArgs.length - 1];
      if (last && typeof last === 'object' && !Array.isArray(last)) {
        callArgs[callArgs.length - 1] = { parse_mode: 'HTML', ...last };
      } else {
        callArgs.push({ parse_mode: 'HTML' });
      }
      return bound(...callArgs);
    };
  };

  wrap(ctx, 'reply');
  wrap(ctx, 'replyWithPhoto');
  wrap(ctx, 'replyWithDocument');
  wrap(ctx, 'replyWithVideo');
  wrap(ctx, 'replyWithAnimation');
  wrap(ctx, 'editMessageText');
  wrap(ctx, 'editMessageCaption');

  wrap(ctx.telegram, 'sendMessage');
  wrap(ctx.telegram, 'editMessageText');
  wrap(ctx.telegram, 'editMessageCaption');
  wrap(ctx.telegram, 'sendPhoto');
  wrap(ctx.telegram, 'sendDocument');
  wrap(ctx.telegram, 'sendVideo');
  wrap(ctx.telegram, 'sendAnimation');

  return next();
};
