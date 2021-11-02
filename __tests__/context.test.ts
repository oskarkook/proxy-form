import { ProviderContext } from '../src/context';

describe('ProviderContext', () => {
  it('updates nested listeners of an array when an element is removed', () => {
    const context = new ProviderContext({ items: [{ id: 1, name: 'name' }, { id: 2, value: 'value'}] });
    const onUpdate = jest.fn();

    context.register([['items', 0, 'name']], onUpdate);
    context.update(f => {
      f.items.splice(0, 1);
    });

    expect(onUpdate).toBeCalledTimes(1);
  });

  it('updates any functions that work on arrays', () => {
    const context = new ProviderContext({ items: [1, 2, 3] });

    const fnNames = Object.getOwnPropertyNames(Array.prototype);
    const listeners = fnNames.map(name => {
      const listener = jest.fn();
      context.register([['items', name]], listener);
      return listener;
    });

    context.update(f => {
      f.items[1] = 10;
      f.items[2] = 11;
    });

    listeners.forEach(listener => {
      expect(listener).toBeCalledTimes(1);
    })
  });
});