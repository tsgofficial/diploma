/**
 * Chat message model.
 *
 * Defined via `sequelize.define()` (functional) — the `Model<...>` generic is
 * used only for attribute inference; we never subclass it, so no OOP is
 * introduced. `sources` stores the doc titles the RAG engine cited (JSONB),
 * null for user turns.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessageModel
  extends Model<
    InferAttributes<ChatMessageModel>,
    InferCreationAttributes<ChatMessageModel>
  > {
  // `id` and timestamps are DB-generated — CreationOptional so they may be
  // omitted on `.create()` while still typed as present on read.
  id: CreationOptional<string>;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  sources: string[] | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const ChatMessage = sequelize.define<ChatMessageModel>(
  'ChatMessage',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'session_id',
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sources: {
      // List of cited document titles from the RAG engine (JSONB, nullable).
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // Declared for typing; values are managed automatically by `timestamps: true`.
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    indexes: [{ fields: ['session_id', 'created_at'] }],
  }
);
