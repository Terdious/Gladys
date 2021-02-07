module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('t_scene', 'group', {
        type: Sequelize.JSON,
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {},
};
