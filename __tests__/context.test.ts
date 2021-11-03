import { Patch } from 'immer';
import { ProviderContext } from '../src/context';


describe('ProviderContext', () => {
  describe('register', () => {
    it('returns unsubscribe function', () => {
      const context = new ProviderContext({ name: 'test' });
      const onUpdate = jest.fn();
      const unsubscribe = context.register([['name']], onUpdate);

      context.update(f => {
        f.name = 'new name';
      });

      expect(onUpdate).toHaveBeenCalledTimes(2);
      unsubscribe();
      
      context.update(f => {
        f.name = 'another name';
      });

      expect(onUpdate).toHaveBeenCalledTimes(2);
    });

    it('calls function with form value on registration', () => {
      const context = new ProviderContext({ name: 'test' });
      const onUpdate = jest.fn();
      context.register([], onUpdate);
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('listen', () => {
    it('returns unsubscribe function', () => {
      const context = new ProviderContext({ name: 'test' });
      const onUpdate = jest.fn();
      const unsubscribe = context.listen(onUpdate);

      context.update(f => {
        f.name = 'new name';
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
      unsubscribe();
      
      context.update(f => {
        f.name = 'another name';
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it('getForm returns current form state', () => {
    const context = new ProviderContext({ name: 'test' });
    expect(context.getForm()).toEqual({ name: 'test' });

    context.update(f => {
      f.name = 'new name';
    });

    expect(context.getForm()).toEqual({ name: 'new name' });
  });

  it('calls update function on registration', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn();
    context.register([], onUpdate);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ name: 'test' });
  });

  it('calls update function after update', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn();
    context.register([['name']], onUpdate);
    context.update(f => {
      f.name = 'new name';
    });
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith({ name: 'new name' });
  })

  it('updates nested listeners of an array when an element is removed', () => {
    const context = new ProviderContext({ items: [{ id: 1, name: 'name' }, { id: 2, value: 'value'}] });
    const onUpdate = jest.fn();

    context.register([['items', 0, 'name']], onUpdate);
    expect(onUpdate).toBeCalledTimes(1);
    context.update(f => {
      f.items.splice(0, 1);
    });

    // once on mount, once on update
    expect(onUpdate).toBeCalledTimes(2);
  });

  it('updates any functions that work on arrays', () => {
    const context = new ProviderContext({ items: [1, 2, 3] });

    const fnNames = Object.getOwnPropertyNames(Array.prototype).filter(n => n !== 'constructor' && n !== 'toLocaleString' && n !== 'toString');
    const listeners = fnNames.map(name => {
      const listener = jest.fn();
      context.register([['items', name]], listener);
      expect(listener).toBeCalledTimes(1);
      return listener;
    });

    context.update(f => {
      f.items[1] = 10;
      f.items[2] = 11;
    });

    listeners.forEach((listener, i) => {
      // once on mount, once on update
      expect(listener).toBeCalledTimes(2);
    })
  });

  it('calls global form listeners on update', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn();
    context.listen(onUpdate);
    context.update(f => {
      f.name = 'new name';
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('provides the form object to global form listeners on update', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn(({ form }) => {
      expect(form.name).toBe('new name');
    });
    context.listen(onUpdate);
    context.update(f => {
      f.name = 'new name';
    });
  });

  it('provides the patch to global form listeners on update', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn();
    context.listen(onUpdate);
    context.update(f => {
      f.name = 'new name';
    });

    const expectedPatch: Patch = {
      op: 'replace',
      path: ['name'],
      value: 'new name',
    };

    expect(onUpdate.mock.calls[0][0].patch).toEqual(expectedPatch);
  })
});