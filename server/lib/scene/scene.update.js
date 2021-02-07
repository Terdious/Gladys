const db = require('../../models');
const { NotFoundError } = require('../../utils/coreErrors');

/**
 * @description Update a scene
 * @param {string} selector - The selector of the scene.
 * @param {Object} scene - A scene object.
 * @returns {Promise} - Resolve with the scene.
 * @example
 * scene.update('my-scene', {
 *   name: 'my scene'
 * });
 */
async function update(selector, scene) {
  console.log("coucou 21")
  console.log(scene)

  const existingScene = await db.Scene.findOne({
    where: {
      selector,
    },
  });

  console.log("coucou 22")
  if (existingScene === null) {
  console.log("coucou 23")
    throw new NotFoundError('Scene not found');
  }

  console.log("coucou 24")
  console.log(existingScene)
  await existingScene.update(scene);

  console.log("coucou 25")
  const plainScene = existingScene.get({ plain: true });
  console.log("coucou 26")
  // add scene to live store
  this.addScene(plainScene);
  // return updated scene
  return plainScene;
}

module.exports = {
  update,
};
