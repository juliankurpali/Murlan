import { Fragment, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

type PresenceProps = {
  children?: ReactNode;
  initial?: boolean;
  mode?: 'sync' | 'wait' | 'popLayout';
};

type GroupProps = {
  children?: ReactNode;
  id?: string;
};

type ConfigProps = {
  children?: ReactNode;
  reducedMotion?: 'user' | 'always' | 'never';
};

type MotionProps = {
  children?: ReactNode;
  layout?: boolean | 'position' | 'size';
  layoutId?: string;
  layoutScroll?: boolean;
  animate?: object | boolean;
  initial?: object | boolean;
  exit?: object;
  whileTap?: object;
  whileHover?: object;
  transition?: object;
  [key: string]: unknown;
};

export function AnimatePresence({ children }: PresenceProps) {
  return <Fragment>{children}</Fragment>;
}

export function LayoutGroup({ children }: GroupProps) {
  return <Fragment>{children}</Fragment>;
}

export function MotionConfig({ children }: ConfigProps) {
  return <Fragment>{children}</Fragment>;
}

function passthrough(Component: ComponentType<object>) {
  return function MotionPassthrough({
    layout: _layout,
    layoutId: _layoutId,
    layoutScroll: _layoutScroll,
    animate: _animate,
    initial: _initial,
    exit: _exit,
    whileTap: _whileTap,
    whileHover: _whileHover,
    transition: _transition,
    ...rest
  }: MotionProps) {
    return <Component {...rest} />;
  };
}

export const MotionView = passthrough(View);
export const MotionPressable = passthrough(Pressable);
export const MotionScrollView = passthrough(ScrollView);

export const cardArc = undefined;

export const cardSelectTransition = {};
export const cardFlightTransition = {};
export const tapTransition = {};
