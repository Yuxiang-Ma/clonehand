# Vendored MyoHand

`hand.xml` is an export of `build_right_hand_from_arm_spec()` from [MyoHub/myo_sim](https://github.com/MyoHub/myo_sim), revision `93b0ca8f4ec90c9899ee7f05fee561e9911da91b`. The export retains the upstream geometry, muscle parameters, joint properties, tendon paths, and fixed proximal scaffold. The compiler mesh directory was made relative. Original meshes are in `meshes/`; the upstream Apache-2.0 license is in `LICENSE`.

The runtime sets zero gravity, a 0.002-second timestep, and the implicit-fast integrator. It hides proximal scaffold meshes without deleting their attachment sites. See `provenance.json` and `../../docs/simulator-decision.md` for scope and limitations.

To regenerate, clone the source repository, check out the exact revision above, then run from the Clonehand root:

```bash
.venv/bin/python scripts/vendor_model.py /path/to/myo_sim
```

A full checkout is sufficient; no installed MyoSuite package is required. The export script checks the revision before writing files. Model upgrades require rerunning the numerical and anatomy-mapping tests.

Upstream references include the MoBL upper-extremity model and 2nd-Hand. Cite Caggiano et al., *MyoSuite: A contact-rich simulation suite for musculoskeletal motor control* (2022), https://arxiv.org/abs/2205.13600, and the references in the upstream hand README when using this model in research.
