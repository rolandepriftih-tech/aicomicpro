import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetCard } from "../../components/preview/AssetCard";

describe("AssetCard", () => {
  const defaultProps = {
    name: "角色A",
    typeLabel: "角色",
    description: "这是一个测试角色",
  };

  it("should render asset name and type", () => {
    render(<AssetCard {...defaultProps} />);

    expect(screen.getByText("角色A")).toBeInTheDocument();
    expect(screen.getByText("角色")).toBeInTheDocument();
  });

  it("should render description", () => {
    render(<AssetCard {...defaultProps} />);

    expect(screen.getByText("这是一个测试角色")).toBeInTheDocument();
  });

  it("should render image when provided", () => {
    render(<AssetCard {...defaultProps} imageUrl="data:image/png;base64,abc" />);

    const img = screen.getByAltText("角色A");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc");
  });

  it("should render waiting text when no image", () => {
    render(<AssetCard {...defaultProps} />);

    expect(screen.getByText("等待定妆")).toBeInTheDocument();
  });

  it("should render generate button when onGenerateImage provided", () => {
    render(<AssetCard {...defaultProps} onGenerateImage={vi.fn()} />);

    expect(screen.getByText(/AI 盲盒生成/)).toBeInTheDocument();
  });

  it("should call onGenerateImage when clicked", () => {
    const onGenerateImage = vi.fn();
    render(<AssetCard {...defaultProps} onGenerateImage={onGenerateImage} />);

    fireEvent.click(screen.getByText(/AI 盲盒生成/));

    expect(onGenerateImage).toHaveBeenCalledWith("角色A", "这是一个测试角色", undefined);
  });

  it("should show loading state when generating", () => {
    render(<AssetCard {...defaultProps} isGenerating={true} onGenerateImage={vi.fn()} />);

    expect(screen.getByText("生成中…")).toBeInTheDocument();
  });

  it("should render copy button", () => {
    render(<AssetCard {...defaultProps} />);

    expect(screen.getByText("复制描述")).toBeInTheDocument();
  });

  it("should render upload button", () => {
    render(<AssetCard {...defaultProps} />);

    expect(screen.getByText(/上传参考/)).toBeInTheDocument();
  });

  it("should render detail blocks when provided", () => {
    const detailBlocks = [
      { title: "状态1", body: "描述1" },
      { title: "状态2", body: "描述2" },
    ];
    render(<AssetCard {...defaultProps} detailBlocks={detailBlocks} />);

    expect(screen.getByText("状态1")).toBeInTheDocument();
    expect(screen.getByText("描述1")).toBeInTheDocument();
    expect(screen.getByText("状态2")).toBeInTheDocument();
    expect(screen.getByText("描述2")).toBeInTheDocument();
  });

  it("should render reference image button when reference provided", () => {
    render(<AssetCard {...defaultProps} referenceImage="data:image/png;base64,ref" onGenerateImage={vi.fn()} />);

    expect(screen.getByText(/AI 参考生成/)).toBeInTheDocument();
  });

  it("should render clear reference button when reference provided", () => {
    render(<AssetCard {...defaultProps} referenceImage="data:image/png;base64,ref" />);

    expect(screen.getByText(/清除参考/)).toBeInTheDocument();
  });
});
