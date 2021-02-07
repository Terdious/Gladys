const asyncMiddleware = require('../middlewares/asyncMiddleware');
const { EVENTS, ACTIONS, ACTIONS_STATUS } = require('../../utils/constants');

/**
 * @apiDefine SceneParam
 * @apiParamExample {json} Request-Example:
 *  {
 *    "name": "New Scene",
 *    "actions": [{
 *      "type": "house.arm",
 *      "house": "main-house",
 *     }],
 *    "group": [
 *      "groupPrimary": "New Group Primary",
 *      "groupSecondary": "New Group Secondary",
 *     ],
 *  }
 */

module.exports = function SceneController(gladys) {
  /**
   * @api {post} /api/v1/scene create
   * @apiName create
   * @apiGroup Scene
   * @apiUse SceneParam
   */
  async function create(req, res) {
    console.log("coucou1")
    const newScene = await gladys.scene.create(req.body);
    res.status(201).json(newScene);
  }

  /**
   * @api {patch} /api/v1/scene/edit/:scene_selector update
   * @apiName update
   * @apiGroup Scene
   * @apiUse SceneParam
   */
  async function update(req, res) {
    console.log("coucou2")
    
    console.log(req.body)
    const newScene = await gladys.scene.update(req.params.scene_selector, req.body);
    res.json(newScene);
  }

  /**
   * @api {get} /api/v1/scene get
   * @apiName get
   * @apiGroup Scene
   *
   */
  async function get(req, res) {
    console.log("coucou3")
    
    console.log(req.query)
    const scenes = await gladys.scene.get(req.query);
    res.json(scenes);
  }

    /**
   * @api {get} /api/v1/scene/:scene_group get scene group
   * @apiName get
   * @apiGroup Scene
   *
   */
  async function getSceneGroups(req, res) {
    console.log("coucou4")
    const scenes = await gladys.scene.getSceneGroups(req.query);
    res.json(scenes);
  }
  
  /**
   * @api {get} /api/v1/scene/edit/:scene_selector get by selector
   * @apiName getBySelector
   * @apiGroup Scene
   *
   */
  async function getBySelector(req, res) {
    console.log("coucou5")
    const scene = await gladys.scene.getBySelector(req.params.scene_selector);
    res.json(scene);
  }

  /**
   * @api {delete} /api/v1/scene/edit/:scene_selector delete
   * @apiName delete
   * @apiGroup Scene
   *
   */
  async function destroy(req, res) {
    console.log("coucou6")
    await gladys.scene.destroy(req.params.scene_selector);
    res.json({
      success: true,
    });
  }

  /**
   * @api {post} /api/v1/scene/edit/:scene_selector/start start
   * @apiName start
   * @apiGroup Scene
   *
   */
  async function start(req, res) {
    console.log("coucou7")
    const action = {
      type: ACTIONS.SCENE.START,
      scene: req.params.scene_selector,
      status: ACTIONS_STATUS.PENDING,
    };
    gladys.event.emit(EVENTS.ACTION.TRIGGERED, action);
    res.json(action);
  }

  return Object.freeze({
    create: asyncMiddleware(create),
    destroy: asyncMiddleware(destroy),
    get: asyncMiddleware(get),
    getSceneGroups: asyncMiddleware(getSceneGroups),
    getBySelector: asyncMiddleware(getBySelector),
    update: asyncMiddleware(update),
    start: asyncMiddleware(start),
  });
};
