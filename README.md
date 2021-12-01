# Proxy Form
Proxy Form is a library that uses JavaScript's
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to make it easy to
work with your form state in React. In practice, this means that you can build forms by simply treating your state as a
regular object.

## Usage
```sh
yarn add proxy-form
```

The main API points are:
- `<FormProvider/>` component, which stores the form state and exposes it as a React context
- `useForm()` hook, which provides helpers to access the form state
- `<UseForm/>` component, which is a wrapper around the `useForm()` hook. [This component is mainly used to encapsulate
rendered fields to avoid re-rendering large React components](#performance-tips)
- `useFormContext()` hook, which provides raw access to the form context. This can be useful in some edge cases

### Example use
`MyFormWrapper.tsx`
```tsx
import React from 'react';
import { FormProvider } from 'proxy-form';
import { MyForm } from './types';
import { MyFormInputs } from './MyFormInputs';

export const MyFormWrapper: React.FC<{}> = () => {
  return (
    <FormProvider<MyForm> defaultValues={{
      name: '',
      someValue: '',
      numbers: [],
    }}>
      <MyFormInputs/>
    </FormProvider>
  );
}
```

`MyFormInputs.tsx`
```tsx
import React from 'react';
import { useForm } from 'proxy-form';
import { MyForm } from './types';

export const MyFormInputs: React.FC<{}> = () => {
  const { form, field, update } = useForm<MyForm>();
  return (
    <div>
      <input type='text' {...field(form.name)}>
      <input type='text' {...field(form.someValue)}>

      {form.name.length > 3 && (
        <span>Hi {form.name}!</span>
      )}

      <div onClick={() => update(form => { form.numbers.push(Math.random() * 100) })}>
        Random numbers: {
          form.numbers.map((number, index) =>
            <span key={index}>{Math.floor(number)}</span>
          )
        }
      </div>
    </div>
  );
}
```

`types.ts`
```ts
export interface MyForm {
  name: string;
  someValue: string;
  numbers: number[];
}
```

## Dependency tracking
As seen in the example, we do not set up explicit dependencies on fields, as you would do with other libraries. Instead,
field dependencies are tracked automatically during rendering. Any fields that you use and access at render time will be
tracked and when the given field changes, the component is re-rendered automatically. This applies to arrays and nested
objects as well.

## Form updates
Updates to the form can be done by calling the `update()` function that is returned from the `useForm()` hook. Updates
are handled through [Immer](https://immerjs.github.io/immer/), so all the documentation from Immer applies to the
update function. In short, you edit your form as you would any other JavaScript object, all the changes are tracked
by Immer and synthesized into a new object:

```ts
update(form => {
  form.name = 'new name';
  form.someValue = 'new value';
  form.numbers.push(2);
});
```

### Global form listeners
Form listeners listen to any updates on a form. When an update is performed, the listeners are called and they can
perform their own changes on the form. This allows for a way to do central updates, e.g. for fields that depend on
each-other.

For example, to centrally uppercase the `name` field in the form:
```tsx
import React from 'react';
import { FormProvider } from 'proxy-form';

interface MyForm {
  name: string;
  someValue: string;
}
export const MyFormComponent: React.FC<{}> = () => {
  const defaultValues: MyForm = {
    name: 'my name',
    someValue: 'some value',
  };

  return (
    <FormProvider defaultValues={defaultValues} listeners={[
      ({ form, patch }) => {
        if(patch.path[0] === 'name') {
          form.name = form.name.toUpperCase();
        }
      }
    ]}>
      <MyComponent/>
    </FormProvider>
  );
}
```

The `patch` variable here is a JSON patch provided by Immer. [The documentation for Immer's patch feature can be found
here.](https://immerjs.github.io/immer/patches/)


## Caution with `field()`!
The `field()` function is similar to React's hooks in that it depends on the execution order. When calling the `field()`
function, you must always access a path through the form proxy:
```ts
// Correct
const { form, field } = useForm<MyForm>();
field(form.item.value);

// Also correct (item object is still a proxy!)
const item = form.item;
field(item.value);

// Incorrect
const value = form.item.value;
field(value);
```

You should not access fields conditionally in the call, e.g:
- `field(form.value || form.otherValue)` or
- `field(form.obj?.value)`
 
In the first case, you should assign the correct value to the form state
itself, e.g. `field(form.valueOrOtherValue)`. In the second case, you should do the existency check outside the
`field()` call:

```tsx
export const MyComponent: React.FC<{}> = () => {
  const { form, field } = useForm<MyForm>();
  return (
    <div>
      {form.obj && (
        <input type='text' {...field(form.obj.value)}>
      )}
      {/* Alternatively: */}
      <input type='text' {...(form.obj ? field(form.obj.value) : {} )}>
    </div>
  );
}
```

Additionally, do not mix `form` and `field()` variables between components:
```tsx
export const MyComponent: React.FC<{}> = () => {
  const { form, field } = useForm<MyForm>();

  return (
    <div>
      {/* Bad: mixing the `field()` function from parent with `form` from child */}
      <UseForm<MyForm> render={({ form }) => (
        <input type='text' {...field(form.name)}>
      )}>
      {/* Bad: mixing the `form` variable from parent with the `field()` function from child */}
      <UseForm<MyForm> render={({ field }) => (
        <input type='text' {...field(form.someValue)}>
      )}>
    </div>
  )
}
```

Many of these are caught automatically, but you should be mindful of it.

## API
### `<FormProvider/>`
Root component, which sets up the context for the form.

Props:
- `defaultValues` - Required. Provides default (initial) values for the form
- `defaultOptions` - Optional. An object with the following optional properties:
  - `mode` - `onBlur` or `onChange`. Defaults to `onChange`, which will trigger updates to the UI on any change. When set to `onBlur`, it will trigger updates to the UI when the field loses focus
- `initialChangedFields` - Optional. Used to restore form state from a previous session, should be an object from
`useFormContext().getChangedFields()`
- `listeners` - Optional. Global listeners that will be called on every form change

### `useForm()`
Hook, which provides some convenience functions and tracks dependencies.

Returns an object with the follow properties:
- `form` - A proxy object around your form. When you access a field on the form, it is recorded as a dependency and your
component will update when the field changes
- `update(callback, options?)` - An Immer update function. See Immer documentation. The following optional options can
be provided:
  - `notify` - When set to `false`, it won't trigger an UI render after the update
- `field(value, options?)`
  - `value` - Required. A value from your form, e.g. `field(form.name)`
  - `options` - Optional. An object with the following optional properties:
    - `mode` - `onBlur` or `onChange`. Defaults to `onChange`, which will trigger updates to the UI on any change. When set to `onBlur`, it will trigger updates to the UI when the field loses focus
    - `transform` - A function to transform the value from the change event, before it is saved into the form
    - `prepare` - A function to prepare the value from the form for the UI element

### `<UseForm/>`
A wrapper around the `useForm()` hook.

### `useFormContext()`
Returns the raw context for the form. It is an object with the following properties:
- `register(fieldPaths, callback)` - Registers a listener on the given paths. Each path is an array, e.g.
`['nestedObject', 'name']` would register the callback on `form.nestedObject.name`. It returns an unsubscribe function,
which when called, will remove the callback subscription
- `listen(callback)` - Registers a listener on the whole form. Whenever there is a change on the form, the callback will
be called. Returns an unsubscribe function
- `getForm()` - Returns the raw form data
- `getChangedFields()` - Returns an object with data about changed fields. Mainly to be used in conjunction with
`FormProvider.initialChangedFields` (see above)
- `update(callback)` - An Immer update function. See Immer documentation
- `trigger()` - Will trigger an UI re-render; any pending form changes will be used to update the UI components
- `defaultOptions` - The default options that were passed into the `FormProvider` component

## Performance tips
Performance in React mainly comes down to avoiding renders of large component trees. You want to focus updates and
re-renders to only the fields that actually change. 

One way to minimize updates is to render the fields in `onBlur` mode. This will trigger updates to the UI only after
the changed field loses focus. See the [API](#api) above for more information.

Another way is to scope the fields to their own component. You can either create your own custom components for this
or you can wrap the field in a `<UseForm/>` component:

```tsx
import React from 'react';
import { UseForm } from 'proxy-form';

export const MyComponent: React.FC<{}> = () => {
  return (
    <div>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.name)}>
      )}>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.someValue)}>
      )}>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.extraField)}>
      )}>
    </div>
  );
}
```

This does introduce some extra fluff into your render tree, but it is an issue that inherently stems from the way
React's rendering engine works and can't be avoided.

## FAQ
### Why?
The other popular form libraries I've tried either are plainly not performant or have an uncomfortable API. I also need
to run custom functions that update a large number of fields that depend on eachother. Here are my issues with the
libraries I've tried:
- [Formik](https://formik.org/)
  - Unperformant with large forms. Making it performant is practically impossible.
- [react-hook-form](https://react-hook-form.com/)
  - A lot of ceremony and custom logic
  - Need to track fields yourself
  - Array updates are difficult to deal with
  - Performance with arrays can be difficult to optimize
  - Updating the form externally can become difficult if you have many inter-dependent fields

### Alternative solutions
The usefulness of the functions that this library provides can be arguable, so it is important to compare it to various
alternatives.

**Other form libraries.** Discussed in the previous section.

[**Overmind.**](https://overmindjs.org/) This can be considered a superior library to `proxy-form`, as it provides close
to the same ergonomics with better primitives. Overmind is a state library first and there is honestly a very small
sliver of use-cases where you don't need the state primitives, but do need the ergonomics and usage patterns of
`proxy-form`. **Consider using Overmind.js over this library!**

**Redux.** Redux offers a more systematic approach to how data is managed and changed. It is a valid alternative when
you need a stricter approach. You'd need a helper library for forms, though.

**State machines.** Same as Redux: it is a more systematic approach and can be a preferred option in some cases, however
you will need helper libraries to make your life easier.

**Passing values through the component tree manually.** This has the following drawbacks:
- Difficult to optimize when you have nested data
- Have to have your own wrapper for field helpers (`field()` in this library)
- Need to religiously use `React.memo()` to actually make React not re-render when the props stay the same
- Have to implement your own update lifecycle

### Why `update()` instead of using the `set()` handler of the Proxy?
The `set()` handler theoretically could offer an even more convenient usage of the state object, as you could directly
manipulate the form data. These are the reasons why the `update()` handler is prefered:
- We use Immer, which simplifies life a lot. Immer has this usage pattern, so we use it, too.
- `update()` makes it easier to do multiple updates in one go. Imagine you have an array where all the elements need to
be changed for some reason. With `set()`, you would end up triggering many changes and re-renders, whereas with
`update()` it ends up being a single change.
- It makes updates explicit. You can't accidentally set some value, but instead you have to essentially declare your
updates, which makes it easier to reason about the data flow.


## Useful information
### Form update cycle
Form updates have a 3-part cycle:
1. The update is performed on the form
2. The form listeners run in a loop until no single listener performs an update (this is necessary since fields can have cascading dependencies)
3. All the registered fields are notified of the changes