# DESIGN AUDIT — Final MVP Pass

## KEEP
- 5-life structure
- enemy-drop POWER CHIP
- paused upgrade selection after 3 chips
- SHOT / POWER / SPEED / SHIELD / BOMB
- LASER and WINGMAN
- boss bullet-clear use case for bomb

## DEFER
- formation mode switching (WIDE / FOCUS / GUARD)
- formation gauge / large allied squadron super
- multiple stages / terrain themes
- audio polish / music
- PWA packaging

## RISK CONTROLS
- Upgrade screen appears only after 3 chips, avoiding excessive interruption.
- SPEED and POWER have hard caps.
- Player collision radius is smaller than the rendered jet silhouette.
- Full power reset on death is avoided.
- Boss is telegraphed with WARNING before spawning.
- SHIELD is explicitly capped at one charge, matching its behavior and UI.
- SHOT progression is implementation-checked as 1 / 2 / 3 / 5 simultaneous bullets.
