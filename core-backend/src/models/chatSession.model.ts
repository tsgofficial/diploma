/**
 * Chat session model.
 *
 * Uses `sequelize.define()` (functional API) — no `class extends Model`. A
 * session groups the messages of one conversation and belongs to a user.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export interface ChatSessionModel
  extends Model<
    InferAttributes<ChatSessionModel>,
    InferCreationAttributes<ChatSessionModel>
  > {
  // DB-generated fields — CreationOptional so `.create()` may omit them.
  id: CreationOptional<string>;
  userId: string | null;
  title: string | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const ChatSession = sequelize.define<ChatSessionModel>(
  'ChatSession',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      // Nullable until the auth/user layer lands; wire the FK there.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Declared for typing; values are managed automatically by `timestamps: true`.
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'chat_sessions',
    timestamps: true,
  }
);
