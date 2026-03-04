import { Animation } from './animations/animation'
import { Keyframe } from './animations/keyframe'
import { Blockbench } from './api'
import { ModelProject } from './io/project'
import { BillboardFace } from './outliner/types/billboard'
import { SplineCurve, SplineHandle, SplineMesh } from './outliner/types/spline_mesh'

Blockbench.Outliner = Outliner
Blockbench.OutlinerNode = OutlinerNode
Blockbench.OutlinerElement = OutlinerElement
Blockbench.Group = Group
Blockbench.Cube = Cube
Blockbench.Mesh = Mesh
Blockbench.Locator = Locator
Blockbench.NullObject = NullObject
Blockbench.TextureMesh = TextureMesh
Blockbench.SplineMesh = SplineMesh

Blockbench.Face = Face
Blockbench.CubeFace = CubeFace
Blockbench.MeshFace = MeshFace
Blockbench.BillboardFace = BillboardFace
Blockbench.SplineHandle = SplineHandle
Blockbench.SplineCurve = SplineCurve
Blockbench.NodePreviewController = NodePreviewController

Blockbench.Animator = Animator
Blockbench.Timeline = Timeline
Blockbench.AnimationItem = AnimationItem
Blockbench.Animation = Animation as unknown as typeof _Animation
Blockbench.AnimationController = AnimationController
Blockbench.AnimationControllerState = AnimationControllerState
Blockbench.Keyframe = Keyframe
Blockbench.KeyframeDataPoint = KeyframeDataPoint
Blockbench.BoneAnimator = BoneAnimator
Blockbench.NullObjectAnimator = NullObjectAnimator
Blockbench.EffectAnimator = EffectAnimator
Blockbench.TimelineMarker = TimelineMarker

Blockbench.Panel = Panel
Blockbench.Mode = Mode
Blockbench.Dialog = Dialog
Blockbench.ShapelessDialog = ShapelessDialog
Blockbench.ToolConfig = ToolConfig
Blockbench.InputForm = InputForm
Blockbench.Setting = Setting
Blockbench.Plugin = Plugin
Blockbench.Preview = Preview
Blockbench.Toolbar = Toolbar

Blockbench.Language = Language
Blockbench.Painter = Painter
Blockbench.Screencam = Screencam
Blockbench.Settings = Settings
Blockbench.TextureAnimator = TextureAnimator
Blockbench.Toolbox = Toolbox
Blockbench.BarItems = BarItems

Blockbench.BarItem = BarItem
Blockbench.Action = Action
Blockbench.Tool = Tool
Blockbench.Toggle = Toggle
Blockbench.Widget = Widget
Blockbench.BarSelect = BarSelect
Blockbench.BarSlider = BarSlider
Blockbench.BarText = BarText
Blockbench.NumSlider = NumSlider
Blockbench.ColorPicker = ColorPicker
Blockbench.Keybind = Keybind
Blockbench.KeybindItem = KeybindItem
Blockbench.Menu = Menu
Blockbench.BarMenu = BarMenu
Blockbench.ResizeLine = ResizeLine

Blockbench.ModelProject = ModelProject
Blockbench.ModelFormat = ModelFormat
Blockbench.Codec = Codec
Blockbench.DisplaySlot = DisplaySlot
Blockbench.Reusable = Reusable

Blockbench.Texture = Texture
Blockbench.TextureLayer = TextureLayer
Blockbench.SharedActions = SharedActions
