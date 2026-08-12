import xml.etree.ElementTree as ET
import glob

def calculate_coverage(xml_file):
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        missed = 0
        covered = 0
        
        for counter in root.findall('counter'):
            if counter.get('type') == 'INSTRUCTION':
                missed += int(counter.get('missed'))
                covered += int(counter.get('covered'))
        
        if missed + covered == 0:
            return 0.0
            
        return (covered / (missed + covered)) * 100
    except Exception as e:
        return 0.0

print("Coverage Report:")
for file in glob.glob("core/*/build/reports/jacoco/test/jacocoTestReport.xml"):
    module = file.split('/')[1]
    cov = calculate_coverage(file)
    print(f"Module {module}: {cov:.2f}%")
