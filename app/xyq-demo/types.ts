export type CreateKind = "image" | "video" | "text";

export type DemoNodeData = {
  id: string;
  title: string;
  kind: "image" | "video" | "text";
  status: "done" | "generating" | "draft" | "empty";
  gradient: string;
  text?: string;
  /* 视频卡时长；其余卡为卡下元信息行 */
  meta?: string;
  /* 卡上方 12px 类型小字（默认"未命名图片/未命名视频/文本"） */
  typeLabel?: string;
  /* 卡下标题行右侧橙色 tag */
  tag?: string;
  /* 图片空卡是否 1:1 变体 */
  emptySquare?: boolean;
  /* 回调通过 data 传入（React Flow data 是普通对象） */
  onAction?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onVariant?: (id: string) => void;
  onDelete?: (id: string) => void;
  [key: string]: unknown;
};
