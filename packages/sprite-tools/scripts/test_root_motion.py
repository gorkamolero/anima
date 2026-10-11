"""Registration regression tests with known image-space translations."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('root_motion', Path(__file__).with_name('root-motion.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RegistrationTests(unittest.TestCase):
    def test_known_translation_ignores_transparent_rgb(self):
        rng = np.random.default_rng(11)
        a = np.zeros((120, 120, 4), dtype=np.uint8)
        a[:, :, :3] = rng.integers(0, 255, (120, 120, 3), dtype=np.uint8)
        a[65:95, 40:65, 3] = 255
        b = np.roll(a, (4, -7), axis=(0, 1))
        b[b[:, :, 3] == 0, :3] = 255
        r = module.register(a, b, [30, 60, 80, 105])
        self.assertAlmostEqual(r['dx'], -7, delta=.1)
        self.assertAlmostEqual(r['dy'], 4, delta=.1)
        self.assertLess(r['residual'], 1e-5)

    def test_fractional_translation(self):
        from PIL import Image
        a = np.zeros((120,120,4), dtype=np.uint8)
        a[60:95,40:70] = [80,120,180,255]
        b = np.asarray(Image.fromarray(a).transform((120,120), Image.Transform.AFFINE, (1,0,-3.3,0,1,2.2), Image.Resampling.BILINEAR))
        r = module.register(a,b,[30,50,80,105])
        self.assertAlmostEqual(r['dx'],3.3,delta=.2)
        self.assertAlmostEqual(r['dy'],-2.2,delta=.2)

if __name__ == '__main__':
    unittest.main()
