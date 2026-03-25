from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import subprocess
import base64
import json
from pathlib import Path
from datetime import datetime

app = Flask(__name__, template_folder='../templates', static_folder='../static')
CORS(app)

# Configuration
ADB_PATH = 'adb'  # Make sure ADB is in PATH or provide full path
SCREENSHOTS_DIR = Path('screenshots')
SCREENSHOTS_DIR.mkdir(exist_ok=True)

class AndroidController:
    """Controller for Android device management"""
    
    def __init__(self):
        self.device_id = None
        self.is_connected = False
    
    def get_connected_devices(self):
        """Get list of connected Android devices"""
        try:
            result = subprocess.run([ADB_PATH, 'devices'], capture_output=True, text=True)
            devices = []
            for line in result.stdout.split('\n')[1:]:
                if '\tdevice' in line:
                    device_id = line.split('\t')[0]
                    devices.append(device_id)
            return devices
        except Exception as e:
            print(f"Error getting devices: {e}")
            return []
    
    def connect_device(self, device_id):
        """Connect to a specific device"""
        try:
            self.device_id = device_id
            self.is_connected = True
            return True
        except Exception as e:
            print(f"Error connecting device: {e}")
            return False
    
    def take_screenshot(self):
        """Take screenshot from connected device"""
        try:
            if not self.device_id:
                return None
            
            # Pull screenshot from device
            screenshot_path = f'/sdcard/screenshot_{datetime.now().timestamp()}.png'
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'shell', 'screencap', '-p', screenshot_path],
                check=True
            )
            
            # Save to local computer
            local_path = SCREENSHOTS_DIR / f'screen_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'pull', screenshot_path, str(local_path)],
                check=True
            )
            
            # Convert to base64
            with open(local_path, 'rb') as f:
                img_base64 = base64.b64encode(f.read()).decode()
            
            return f"data:image/png;base64,{img_base64}"
        except Exception as e:
            print(f"Error taking screenshot: {e}")
            return None
    
    def tap(self, x, y):
        """Tap on screen at coordinates"""
        try:
            if not self.device_id:
                return False
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'shell', 'input', 'tap', str(x), str(y)],
                check=True
            )
            return True
        except Exception as e:
            print(f"Error tapping: {e}")
            return False
    
    def swipe(self, x1, y1, x2, y2, duration=500):
        """Swipe on screen"""
        try:
            if not self.device_id:
                return False
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'shell', 'input', 'swipe', 
                 str(x1), str(y1), str(x2), str(y2), str(duration)],
                check=True
            )
            return True
        except Exception as e:
            print(f"Error swiping: {e}")
            return False
    
    def type_text(self, text):
        """Type text on device"""
        try:
            if not self.device_id:
                return False
            # Escape special characters
            text = text.replace("'", "'\\'\'\'\'")
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'shell', 'input', 'text', text],
                check=True
            )
            return True
        except Exception as e:
            print(f"Error typing: {e}")
            return False
    
    def press_key(self, key_code):
        """Press a key on device"""
        try:
            if not self.device_id:
                return False
            key_map = {
                'home': 3,
                'back': 4,
                'recent': 187,
                'power': 26,
                'volume_up': 24,
                'volume_down': 25,
            }
            code = key_map.get(key_code, key_code)
            subprocess.run(
                [ADB_PATH, '-s', self.device_id, 'shell', 'input', 'keyevent', str(code)],
                check=True
            )
            return True
        except Exception as e:
            print(f"Error pressing key: {e}")
            return False

# Initialize controller
controller = AndroidController()

# Routes
@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Get connected devices"""
    devices = controller.get_connected_devices()
    return jsonify({'devices': devices, 'current': controller.device_id})

@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to device"""
    data = request.json
    device_id = data.get('device_id')
    success = controller.connect_device(device_id)
    return jsonify({'success': success, 'device_id': device_id})

@app.route('/api/screenshot', methods=['GET'])
def screenshot():
    """Get screenshot"""
    img_data = controller.take_screenshot()
    if img_data:
        return jsonify({'success': True, 'image': img_data})
    return jsonify({'success': False, 'error': 'Failed to take screenshot'})

@app.route('/api/tap', methods=['POST'])
def tap():
    """Tap on screen"""
    data = request.json
    x, y = data.get('x'), data.get('y')
    success = controller.tap(x, y)
    return jsonify({'success': success})

@app.route('/api/swipe', methods=['POST'])
def swipe():
    """Swipe on screen"""
    data = request.json
    x1, y1, x2, y2 = data.get('x1'), data.get('y1'), data.get('x2'), data.get('y2')
    success = controller.swipe(x1, y1, x2, y2)
    return jsonify({'success': success})

@app.route('/api/type', methods=['POST'])
def type_text():
    """Type text"""
    data = request.json
    text = data.get('text', '')
    success = controller.type_text(text)
    return jsonify({'success': success})

@app.route('/api/key', methods=['POST'])
def press_key():
    """Press key"""
    data = request.json
    key = data.get('key')
    success = controller.press_key(key)
    return jsonify({'success': success})

@app.route('/api/status', methods=['GET'])
def status():
    """Get current status"""
    return jsonify({
        'connected': controller.is_connected,
        'device_id': controller.device_id,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)