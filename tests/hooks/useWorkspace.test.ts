import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspace } from "../../app/hooks/useWorkspace";

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: (key: string) => mockLocalStorage.store[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage.store[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage.store[key]; },
  clear: () => { mockLocalStorage.store = {}; },
};

// Mock fetch
global.fetch = vi.fn();

describe("useWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisResult).toBeNull();
    expect(result.current.currentView).toBe("assets");
    expect(result.current.textProvider).toBe("gemini");
    expect(result.current.textModel).toBe("gemini-2.5-pro");
  });

  it("should update currentView", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setCurrentView("storyboard");
    });

    expect(result.current.currentView).toBe("storyboard");
  });

  it("should update textProvider", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setTextProvider("openai");
    });

    expect(result.current.textProvider).toBe("openai");
  });

  it("should update textModel", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setTextModel("gpt-4o");
    });

    expect(result.current.textModel).toBe("gpt-4o");
  });

  it("should reset all state", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setCurrentView("storyboard");
      result.current.setTextModel("gpt-4o");
    });

    act(() => {
      result.current.handleReset();
    });

    expect(result.current.currentView).toBe("assets");
    expect(result.current.analysisResult).toBeNull();
    expect(result.current.storyboardResult).toBeNull();
  });

  it("should update assetDescOverrides", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.handleAssetDescriptionChange("角色A", "新的描述");
    });

    expect(result.current.assetDescOverrides["角色A"]).toBe("新的描述");
  });

  it("should remove assetDescOverrides when empty", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.handleAssetDescriptionChange("角色A", "新的描述");
    });

    act(() => {
      result.current.handleAssetDescriptionChange("角色A", "");
    });

    expect(result.current.assetDescOverrides["角色A"]).toBeUndefined();
  });

  it("should update assetReferenceImages", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.handleAssetReferenceImageChange("角色A", "data:image/png;base64,abc");
    });

    expect(result.current.assetReferenceImages["角色A"]).toBe("data:image/png;base64,abc");
  });

  it("should remove assetReferenceImages when null", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.handleAssetReferenceImageChange("角色A", "data:image/png;base64,abc");
    });

    act(() => {
      result.current.handleAssetReferenceImageChange("角色A", null);
    });

    expect(result.current.assetReferenceImages["角色A"]).toBeUndefined();
  });

  it("should handle testAPI success", async () => {
    const mockResponse = { textSuccess: true, imageSuccess: true, message: "OK" };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useWorkspace());

    await act(async () => {
      await result.current.handleTestAPI();
    });

    expect(result.current.testResult?.text).toBe(true);
    expect(result.current.testResult?.image).toBe(true);
  });

  it("should handle testAPI failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useWorkspace());

    await act(async () => {
      await result.current.handleTestAPI();
    });

    expect(result.current.testResult?.text).toBe(false);
    expect(result.current.testResult?.image).toBe(false);
  });
});
