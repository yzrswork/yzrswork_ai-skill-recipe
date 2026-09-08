# DESIGN AUDIT — Recovery Pass

## KEEP
- 5-life structure
- enemy-drop POWER CHIP
- paused upgrade selection
- shot / speed / shield / bomb
- laser and wingman because they can be implemented cheaply in the same projectile loop
- boss bullet-clear use case for bomb

## DEFER
- formation mode switching (WIDE / FOCUS / GUARD)
- formation gauge / large allied squadron super
- multiple stages / terrain themes
- audio polish / music
- PWA packaging

## RISK CONTROLS
- Upgrade screen only appears after 3 chips, avoiding excessive flow interruption.
- Speed has a hard cap.
- Player collision radius is smaller than the rendered jet silhouette.
- Full power reset on death is avoided.
- Boss is telegraphed with WARNING before spawning.
