module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '语言名称'
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '语言编码，如 zh-CN'
      },
      params: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '翻译参数提示'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '描述'
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
        comment: '状态：open 启用，closed 禁用'
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否为默认语言'
      },
      sort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序，越小越靠前'
      }
    },
    associate: ({ langType }) => {
      langType.belongsTo(options.getUserModel(), {
        foreignKey: 'userId',
        as: 'createdUser',
        comment: '添加人'
      });
    },
    options: {
      comment: '语言类型',
      indexes: [
        {
          unique: true,
          fields: ['code'],
          where: { deleted_at: null }
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['sort']
        }
      ]
    }
  };
};
