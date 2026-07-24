module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      namespace: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '命名空间'
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '词条编码'
      },
      locale: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '语言编码'
      },
      target: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '',
        comment: '译文'
      },
      reviewStatus: {
        type: DataTypes.ENUM('approved', 'pending', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        comment: '审核状态'
      },
      reviewRemark: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '审核备注'
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
        comment: '状态：open 启用，closed 禁用'
      }
    },
    associate: ({ langLib }) => {
      langLib.belongsTo(options.getUserModel(), {
        foreignKey: 'userId',
        as: 'createdUser',
        comment: '添加人'
      });
    },
    options: {
      comment: '语言库词条',
      indexes: [
        {
          unique: true,
          fields: ['namespace', 'code', 'locale'],
          where: { deleted_at: null }
        },
        {
          fields: ['namespace', 'code']
        },
        {
          fields: ['locale']
        },
        {
          fields: ['review_status']
        },
        {
          fields: ['user_id']
        }
      ]
    }
  };
};
