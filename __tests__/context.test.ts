import { Patch } from 'immer';
import { ProviderContext } from '../src/context';
import { isFunction } from '../src/helpers';


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

    it('calls update function with form value on registration', () => {
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

  describe('getForm', () => {
    it('returns current form state', () => {
      const context = new ProviderContext({ name: 'test' });
      expect(context.getForm()).toEqual({ name: 'test' });
  
      context.update(f => {
        f.name = 'new name';
      });
  
      expect(context.getForm()).toEqual({ name: 'new name' });
    });
  });

  describe('trigger', () => {
    it('will notify all registered listeners of the pending patches', () => {
      const context = new ProviderContext({ name: 'test' });
      const onUpdate = jest.fn();
      context.register([['name']], onUpdate);
      expect(onUpdate).toHaveBeenCalledTimes(1);

      context.update(f => {
        f.name = 'new name';
      }, { notify: false });

      expect(onUpdate).toHaveBeenCalledTimes(1);

      context.trigger();
      expect(onUpdate).toHaveBeenCalledTimes(2);
    });
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

  it('updates basic array iterators like map and forEach', () => {
    const value = { items: [1, 2, 3] };
    const context = new ProviderContext(value);
    const mapListener = jest.fn();
    const forEachListener = jest.fn();

    context.register([['items', 'map']], mapListener);
    context.register([['items', 'forEach']], forEachListener);

    context.update(f => {
      f.items.push(4);
    });

    expect(mapListener).toBeCalledTimes(2);
    expect(forEachListener).toBeCalledTimes(2);
  });

  it('updates any listeners that depend on array iterators', () => {
    const context = new ProviderContext({ items: [1, 2, 3] });

    const listeners = Object.entries(Object.getOwnPropertyDescriptors(Array.prototype)).filter(([n, d]) => isFunction(d.value)).map(([name, descriptor]) => {
      const listener = jest.fn();
      context.register([['items', name]], listener);
      expect(listener).toBeCalledTimes(1);
      return listener;
    });

    expect(listeners).toHaveLength(32);

    context.update(f => {
      f.items[1] = 10;
      f.items[2] = 11;
    });

    listeners.forEach((listener) => {
      // once on mount, once on update
      expect(listener).toBeCalledTimes(2);
    });
  });

  it('updates any listeners that depend on array elements', () => {
    const context = new ProviderContext({ items: [1, 2, 3] });
    const onUpdate = jest.fn();
    context.register([['items', 1]], onUpdate);
    expect(onUpdate).toBeCalledTimes(1);
    context.update(f => {
      f.items[1] = 10;
    });
    expect(onUpdate).toBeCalledTimes(2);

    // Should not update when another element is updated
    context.update(f => {
      f.items[2] = 11;
    })
    expect(onUpdate).toBeCalledTimes(2);
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
  });

  it('provides the changed function to global form listeners', () => {
    const context = new ProviderContext({ name: 'test' });
    const onUpdate = jest.fn(({ changed }) => {
      expect(changed(['name'])).toBe(true);
    });
    context.listen(onUpdate);
    context.update(f => {
      f.name = 'new name';
    });
  });

  it('runs global listeners until there are no updates left', () => {
    const context = new ProviderContext({ name: 'test' });

    let i = 0;
    const onUpdate = jest.fn(({ form, patch }) => {
      if(i < 2) {
        form.name = `new name ${++i}`;
      }
    });
    context.listen(onUpdate);
    context.update(f => {
      f.name = 'new name 0';
    });

    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate.mock.calls[0][0].patch.value).toBe('new name 0');
    expect(onUpdate.mock.calls[1][0].patch.value).toBe('new name 1');
    expect(onUpdate.mock.calls[2][0].patch.value).toBe('new name 2');
  });

  it('will not call listeners that depend on fields that were not updated', () => {
    const context = new ProviderContext({ name: 'test', value: 'value' });
    const onNameUpdate = jest.fn();
    const onValueUpdate = jest.fn();

    context.register([['name']], onNameUpdate);
    context.register([['value']], onValueUpdate);

    context.update(f => {
      f.name = 'new name';
    });

    expect(onNameUpdate).toHaveBeenCalledTimes(2);
    expect(onValueUpdate).toHaveBeenCalledTimes(1);

    context.update(f => {
      f.value = 'new value';
    });

    expect(onNameUpdate).toHaveBeenCalledTimes(2);
    expect(onValueUpdate).toHaveBeenCalledTimes(2);
  });

  it('updates nested listeners', () => {
    const context = new ProviderContext({ items: [{ name: 'test' }, {name: 'test2'}] });
    const onUpdate = jest.fn();
    context.register([['items', 0, 'name']], onUpdate);

    context.update(f => {
      f.items[0].name = 'new name';
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
  });
});