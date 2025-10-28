"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TransportMode = "normal" | "cautious";

type SliderFlag = "hidden" | "active-default" | "disabled-default";

type TransportControlsContextValue = {
  mode: TransportMode;
  setMode: (mode: TransportMode) => void;
  sliderVisible: boolean;
  sliderFlag: SliderFlag;
  defaultMode: TransportMode;
};

const STORAGE_KEY = "megaTip.transportMode";

const defaultContext: TransportControlsContextValue = {
  mode: "normal",
  setMode: () => undefined,
  sliderVisible: false,
  sliderFlag: "hidden",
  defaultMode: "normal",
};

const TransportControlsContext = createContext<TransportControlsContextValue>(defaultContext);

function parseSliderFlag(value: string | undefined): SliderFlag {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "active-default":
      return "active-default";
    case "disabled-default":
      return "disabled-default";
    case "hidden":
    default:
      return "hidden";
  }
}

export function TransportControlsProvider({ children }: { children: ReactNode }) {
  const sliderFlag = parseSliderFlag(
    process.env.NEXT_PUBLIC_TRANSPORT_SLIDER_MODE ??
      process.env.PUBLIC_TRANSPORT_SLIDER_MODE,
  );

  const sliderVisible = sliderFlag !== "hidden";
  const defaultMode: TransportMode = sliderFlag === "active-default" ? "cautious" : "normal";

  const [modeState, setModeState] = useState<TransportMode>(() => {
    if (!sliderVisible) return defaultMode;
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "cautious" || stored === "normal" ? stored : defaultMode;
  });

  useEffect(() => {
    if (sliderVisible || typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  }, [sliderVisible]);

  useEffect(() => {
    if (!sliderVisible) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, modeState);
  }, [modeState, sliderVisible]);

  const setMode = useCallback(
    (next: TransportMode) => {
      if (!sliderVisible) return;
      setModeState(next);
    },
    [sliderVisible],
  );

  const value = useMemo<TransportControlsContextValue>(
    () => ({
      mode: sliderVisible ? modeState : defaultMode,
      setMode,
      sliderVisible,
      sliderFlag,
      defaultMode,
    }),
    [defaultMode, modeState, setMode, sliderFlag, sliderVisible],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.transportSlider = sliderFlag;
  }, [sliderFlag]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const globalWindow = window as typeof window & {
      __MEGATIP_TRANSPORT_MODE__?: TransportMode;
    };
    globalWindow.__MEGATIP_TRANSPORT_MODE__ = sliderVisible ? modeState : defaultMode;
  }, [defaultMode, modeState, sliderVisible]);

  return (
    <TransportControlsContext.Provider value={value}>
      {children}
    </TransportControlsContext.Provider>
  );
}

export function useTransportControls() {
  return useContext(TransportControlsContext);
}

export type { TransportMode, SliderFlag };
